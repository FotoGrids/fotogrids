const subscribers = new Set();
let entries = [];
let nextId = 1;

const notify = () => {
    const snapshot = entries.slice();
    subscribers.forEach((cb) => cb(snapshot));
};

const makeId = () => `fg-modal-imperative-${ nextId++ }`;

export const modalRegistry = {
    subscribe(cb) {
        subscribers.add(cb);
        cb(entries.slice());
        return () => subscribers.delete(cb);
    },

    open(options = {}) {
        const id = options.id || makeId();
        const entry = { id, options };
        entries = entries.concat(entry);
        notify();

        return {
            id,
            close: () => modalRegistry.close(id),
            update: (next) => modalRegistry.update(id, next),
        };
    },

    update(id, next = {}) {
        let changed = false;
        entries = entries.map((entry) => {
            if (entry.id !== id) return entry;
            changed = true;
            return { ...entry, options: { ...entry.options, ...next } };
        });
        if (changed) notify();
    },

    close(id) {
        const before = entries.length;
        entries = entries.filter((entry) => entry.id !== id);
        if (entries.length !== before) notify();
    },

    closeAll() {
        if (entries.length === 0) return;
        entries = [];
        notify();
    },

    list() {
        return entries.slice();
    },
};
