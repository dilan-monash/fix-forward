# Application entry point: Gunicorn imports app:app; running this file starts local Flask on 127.0.0.1:5000.
# create_app wires routes and the shared access gate. Importing this entry point does not query Neon.

"""Production entry point used by Gunicorn and local Flask commands."""

from backend import create_app


# Gunicorn imports this variable with ``app:app``.
app = create_app()


if __name__ == "__main__":
    # The built-in server is only for local development. Production uses Gunicorn.
    app.run(host="127.0.0.1", port=5000, debug=False)

