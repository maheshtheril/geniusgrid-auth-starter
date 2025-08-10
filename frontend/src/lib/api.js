// tiny wrapper that strips leading slashes so you never get /api/api again
import { http } from "./http";

function clean(p) { return String(p || "").replace(/^\/+/, ""); }

export const api = {
  get:  (p, config)          => http.get(clean(p), config),
  post: (p, data, config)    => http.post(clean(p), data, config),
  put:  (p, data, config)    => http.put(clean(p), data, config),
  patch:(p, data, config)    => http.patch(clean(p), data, config),
  delete:(p, config)         => http.delete(clean(p), config),
};
