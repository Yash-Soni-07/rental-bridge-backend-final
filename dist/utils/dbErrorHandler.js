export const isConstraintViolation = (error) => {
    const code = error?.code;
    return (code === "23503" || // foreign_key_violation
        code === "23505" || // unique_violation (email, username, property_amenities unique index, etc.)
        code === "23502" || // not_null_violation
        code === "23514" || // check_violation (your added CHECK constraints)
        code === "22001" // string_data_right_truncation (varchar length exceeded)
    );
};
//# sourceMappingURL=dbErrorHandler.js.map