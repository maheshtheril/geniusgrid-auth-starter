// ⛔ remove getMenus + useCallback, and replace the loader with this:
useEffect(() => {
  let live = true;
  (async () => {
    setLoading(true);
    try {
      if (typeof fetchMenus !== "function") {
        throw new Error("fetchMenus must be a function");
      }
      const data = await fetchMenus(); // <-- use the prop ONLY
      if (!live) return;
      setMenus(Array.isArray(data) ? data : data?.menus || []);
      setError(null);
    } catch (e) {
      console.error("Sidebar: fetchMenus failed", e);
      if (!live) return;
      setError("Could not load menus");
    } finally {
      if (live) setLoading(false);
    }
  })();
  return () => { live = false; };
}, [fetchMenus]);
