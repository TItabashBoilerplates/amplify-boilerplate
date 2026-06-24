"""Cross-service domain exceptions.

これらの例外は認証ミドルウェア（Cognito JWT 検証）等の複数サービス・複数
レイヤーから raise される共通の失敗種別を表す。
サービス固有の例外 (例: `ResourceNotFoundError`) は各サービスの `domain/exceptions.py`
で定義し、ここには置かない。
"""


class AuthenticationError(Exception):
    """Raised when authentication fails."""


class ConfigurationError(Exception):
    """Raised when configuration is invalid or missing."""
