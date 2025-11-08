export class NetworkError extends Error {
  constructor(message = 'Unable to reach the API server.', options?: ErrorOptions) {
    super(message, options);
    this.name = 'NetworkError';
  }
}
