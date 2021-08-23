module.exports = {
    public(visibility) {
        return visibility === "public";
    },

    hasPublic(children) {
        return children.visibility === "public";
    },

    filterContracts(list, item) {
        return list.filter(i => i.name !== item);
    }
};
