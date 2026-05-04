export const parseId = (idParam) => {
    if (!idParam || Array.isArray(idParam))
        return null;
    const id = Number(idParam);
    if (!id || isNaN(id))
        return null;
    return id;
};
//# sourceMappingURL=parseId.js.map