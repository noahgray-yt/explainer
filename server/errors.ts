/** Error with a readable message (and optional hint) for the UI. */
export class UserError extends Error {
  constructor(
    message: string,
    public hint?: string,
    public status = 400,
  ) {
    super(message);
  }
}
