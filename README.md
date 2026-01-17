# PDF Compressor

高度な画像再圧縮技術を用いた、プライバシー重視のブラウザ完結型PDF軽量化ツールです。

## 特徴
- **プライバシー保護**: 全ての処理をブラウザ（クライアントサイド）で実行。サーバーにデータを送信しません。
- **メタデータ削除**: 圧縮時にPDFのメタデータを完全に消去し、作成者情報などを保護します。
- **高速・安定**: Web Workersの導入により、UIをフリーズさせることなく大容量ファイルの処理が可能です。
- **セキュリティ**: 厳格なContent Security Policy (CSP) を定義し、外部依存を排除したローカルライブラリ構成を採用しています。

## 開発
- 公開日: 2026年1月17日 (v1.8.0 Stable)
- 開発者: HiroBerry (Digital Staff Series Foundation Edition)

## 技術スタック
- **Frontend**: HTML5, Vanilla CSS, Vanilla JS
- **Libraries**: [pdf.js](https://mozilla.github.io/pdf.js/), [pdf-lib](https://pdf-lib.js.org/)
- **Core Technology**: Web Workers, OffscreenCanvas

## ライセンス
MIT License
