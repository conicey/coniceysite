const _db = window.supabaseClient;
const BUCKET = 'VAULT';

const API = {

  // ── Database ─────────────────────────────────────────────────

  async createItem(payload) {
    const { data, error } = await _db
      .from('files')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteItem(id) {
    const { error } = await _db
      .from('files')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async updateItem(id, updates) {
    const { data, error } = await _db
      .from('files')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchItems() {
    const { data, error } = await _db
      .from('files')
      .select('*');
    if (error) throw error;
    return data;
  },

  // ── Storage ──────────────────────────────────────────────────

  /**
   * Upload a File object to Supabase Storage.
   * Returns the public URL string.
   */
  async uploadFile(file, path) {
    const { error } = await _db.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true });
    if (error) throw error;

    const { data } = _db.storage
      .from(BUCKET)
      .getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Update text content for a file in Storage.
   */
  async updateFileContent(path, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const { error } = await _db.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true });
    if (error) throw error;

    const { data } = _db.storage
      .from(BUCKET)
      .getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Download file content from Storage.
   */
  async downloadFile(path) {
    const { data, error } = await _db.storage
      .from(BUCKET)
      .download(path);
    if (error) throw error;
    return data;
  },

  /**
   * Delete a file from Supabase Storage by its path.
   */
  async deleteFile(path) {
    const { error } = await _db.storage
      .from(BUCKET)
      .remove([path]);
    if (error) throw error;
  },

  /**
   * Get the public URL for an existing storage path.
   */
  getPublicUrl(path) {
    const { data } = _db.storage
      .from(BUCKET)
      .getPublicUrl(path);
    return data.publicUrl;
  },
};

window.API = API;
