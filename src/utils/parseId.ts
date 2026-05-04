export const parseId = (idParam: string | string[] | undefined): number | null => {
    if (!idParam || Array.isArray(idParam)) return null;

    const id = Number(idParam);
    if (!id || isNaN(id)) return null;

    return id;
};