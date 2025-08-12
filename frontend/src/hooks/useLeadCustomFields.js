import { useState, useEffect } from "react";
import { http } from "@/lib/http";

export function useLeadCustomFields() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchFields() {
    try {
      setLoading(true);
      const { data } = await http.get("/leads/custom-fields");
      setFields(data || []);
    } catch (err) {
      console.error("Error fetching custom fields", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFields();
  }, []);

  return { fields, loading, refetch: fetchFields };
}
