export class WorkshopError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'WorkshopError'; this.code = code; this.status = status; }
}
