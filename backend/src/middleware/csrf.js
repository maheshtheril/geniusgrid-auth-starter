// src/middleware/csrf.js
import csrf from "csurf";
export const csrfProtection = csrf({ cookie: false }); // token in session