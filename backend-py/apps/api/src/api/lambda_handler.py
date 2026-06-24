"""AWS Lambda entrypoint for the FastAPI app (via Mangum).

The Amplify custom function (`amplify/functions/api/resource.ts`) sets the
Lambda handler to `api.lambda_handler.handler`. Mangum adapts the FastAPI
ASGI app to the Lambda event/response model (works with both API Gateway and
Lambda Function URLs).
"""

from __future__ import annotations

from mangum import Mangum

from api.app import app

handler = Mangum(app)
