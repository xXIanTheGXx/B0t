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

    async bulkWrite(ops) {
        let modifiedCount = 0;
        let upsertedCount = 0;

        for (const op of ops) {
            if (op.updateOne) {
                const { filter, update, upsert } = op.updateOne;
                const index = this.data.findIndex(doc => this._matches(doc, filter));

                if (index !== -1) {
                    // Update existing
                    if (update.$set) {
                        Object.assign(this.data[index], update.$set);
                    }
                    modifiedCount++;
                } else if (upsert) {
                    // Insert new
                    const newDoc = { ...filter };
                    if (update.$set) {
                        Object.assign(newDoc, update.$set);
                    }
                    this.data.push(newDoc);
                    upsertedCount++;
                }
            }
        }
        this.save();
        return { modifiedCount, upsertedCount };
    }

    // Helper for selecting specific fields (projection) - minimal implementation
    select(fields) {
         // This is usually chained after find(), but find() returns a Cursor.
         // We'll implement select() on the Cursor.
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
                     // Assign back to nested structure?
                     // For simplicity, we'll just keep it flat or use a helper to reconstruct
                     // But existing code expects structured data.
                     // Let's try to reconstruct basic nested structure
                     this._setNestedValue(newDoc, field, val);
                }
            });
             // Always include critical fields if they exist and weren't excluded?
             // Mongoose usually includes _id. We'll skip that complexity.
             return newDoc;
        });
        return this;
    }

    then(resolve, reject) {
        resolve(this.results);
    }

    // Helper for nested property access
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
