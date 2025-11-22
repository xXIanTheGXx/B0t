const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
const BLACKLIST_FILE = path.join(DATA_DIR, 'blacklist.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

class Collection extends EventEmitter {
    constructor(filePath) {
        super();
        this.filePath = filePath;
        this.data = [];
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const content = fs.readFileSync(this.filePath, 'utf-8');
                if (content.trim()) {
                    this.data = JSON.parse(content);
                }
            }
        } catch (err) {
            console.error(`Error loading database from ${this.filePath}:`, err);
            this.data = [];
        }
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console.error(`Error saving database to ${this.filePath}:`, err);
        }
    }

    // Basic Query Matcher
    _matches(doc, query) {
        for (const key in query) {
            const value = query[key];
            const docValue = this._getNestedValue(doc, key);

            if (value instanceof RegExp) {
                if (typeof docValue !== 'string' || !value.test(docValue)) return false;
            } else if (typeof value === 'object' && value !== null) {
                // Handle operators
                if (value.$gte !== undefined) {
                    if (typeof docValue !== 'number' || docValue < value.$gte) return false;
                }
                if (value.$exists !== undefined) {
                    const exists = docValue !== undefined && docValue !== null;
                    if (exists !== value.$exists) return false;
                }
                if (value.$ne !== undefined) {
                    // simple equality check for $ne
                    if (JSON.stringify(docValue) === JSON.stringify(value.$ne)) return false;
                }
            } else {
                // Exact match
                if (docValue !== value) return false;
            }
        }
        return true;
    }

    _getNestedValue(obj, path) {
        return path.split('.').reduce((o, k) => (o || {})[k], obj);
    }

    _updateDoc(doc, update) {
        if (update.$set) {
            // Simple implementation: merge top-level keys or direct assignment
            // Mongoose does deep merge. We will do shallow merge for top level keys,
            // but strictly speaking we should handle dot notation updates.
            // Given the scope, let's handle simple object assignment.

            for (const key in update.$set) {
                 // If key contains dot, handle nested
                 if (key.includes('.')) {
                     const parts = key.split('.');
                     let current = doc;
                     for(let i=0; i<parts.length-1; i++) {
                         if (!current[parts[i]]) current[parts[i]] = {};
                         current = current[parts[i]];
                     }
                     current[parts[parts.length-1]] = update.$set[key];
                 } else {
                     doc[key] = update.$set[key];
                 }
            }
        }
        // Add other operators if needed, like $inc, $push
    }

    // API Methods matching Mongoose
    find(query = {}) {
        const results = this.data.filter(doc => this._matches(doc, query));
        return new QueryCursor(results);
    }

    async findOne(query = {}) {
        return this.data.find(doc => this._matches(doc, query)) || null;
    }

    async countDocuments(query = {}) {
        return this.data.filter(doc => this._matches(doc, query)).length;
    }

    async exists(query = {}) {
        return !!this.data.find(doc => this._matches(doc, query));
    }

    async create(doc) {
        const newDoc = { ...doc, _id: Date.now().toString() + Math.random() };
        this.data.push(newDoc);
        this.save();
        return newDoc;
    }

    // Missing method implemented for server.js compatibility
    async findOneAndUpdate(filter, update, options = {}) {
        let doc = this.data.find(d => this._matches(d, filter));

        if (doc) {
            this._updateDoc(doc, update);
        } else if (options.upsert) {
            doc = { ...filter, _id: Date.now().toString() + Math.random() };
            this._updateDoc(doc, update);
            this.data.push(doc);
        } else {
            return null;
        }

        this.save();
        return doc;
    }

    async bulkWrite(ops) {
        let modifiedCount = 0;
        let upsertedCount = 0;

        for (const op of ops) {
            if (op.updateOne) {
                const { filter, update, upsert } = op.updateOne;
                const index = this.data.findIndex(doc => this._matches(doc, filter));

                if (index !== -1) {
                    // Update existing
                    this._updateDoc(this.data[index], update);
                    modifiedCount++;
                } else if (upsert) {
                    // Insert new
                    const newDoc = { ...filter, _id: Date.now().toString() + Math.random() };
                    this._updateDoc(newDoc, update);
                    this.data.push(newDoc);
                    upsertedCount++;
                }
            }
        }
        this.save();
        return { modifiedCount, upsertedCount };
    }

    select(fields) {
         return this;
    }
}

class QueryCursor {
    constructor(results) {
        this.results = results;
    }

    sort(criteria) {
        const keys = Object.keys(criteria);
        if (keys.length === 0) return this;

        const key = keys[0]; // Simplify: only support one sort key
        const direction = criteria[key];

        this.results.sort((a, b) => {
            const valA = this._getNestedValue(a, key);
            const valB = this._getNestedValue(b, key);
            if (valA < valB) return direction === 1 ? -1 : 1;
            if (valA > valB) return direction === 1 ? 1 : -1;
            return 0;
        });
        return this;
    }

    skip(n) {
        this.results = this.results.slice(n);
        return this;
    }

    limit(n) {
        this.results = this.results.slice(0, n);
        return this;
    }

    select(fieldsString) {
        const fields = fieldsString.split(' ');
        this.results = this.results.map(doc => {
            const newDoc = {};
            fields.forEach(field => {
                const val = this._getNestedValue(doc, field);
                if (val !== undefined) {
                     this._setNestedValue(newDoc, field, val);
                }
            });
             return newDoc;
        });
        return this;
    }

    then(resolve, reject) {
        resolve(this.results);
    }

    _getNestedValue(obj, path) {
        return path.split('.').reduce((o, k) => (o || {})[k], obj);
    }

    _setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key]) current[key] = {};
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;
    }
}


const Server = new Collection(SERVERS_FILE);
const Blacklist = new Collection(BLACKLIST_FILE);

async function connect(uri) {
    console.log('Connected to FileSystem Database');
    Server.load();
    Blacklist.load();
}

async function disconnect() {
    console.log('Disconnected from FileSystem Database');
    Server.save();
    Blacklist.save();
}

module.exports = {
    Server,
    Blacklist,
    connect,
    disconnect
};
