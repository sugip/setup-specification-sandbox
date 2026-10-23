# セットアップ仕様リポジトリ

マルチテナントプロダクトのセットアップ仕様を YAML で管理する。

## 構成

- `spec/catalog.yaml` — 機能カタログ。標準プロダクトの最大値（どの機能があり、必須か ON/OFF 可能か、制約事項、必要なデータ）。テナント固有の値は書かない。
- `spec/tenants/<id>.yaml` — 1テナント1ファイル。標準との差分だけを書く。
- `schema/*.schema.json` — 上記のスキーマ。各フィールドの意味は description を参照。
- `scripts/validate.mjs` — スキーマと整合性ルールの検証。
- `scripts/build.mjs` — `dist/index.html`（一覧ページ）と `dist/tenants/<id>.json`（全機能の解決済み設定値）を生成。

## ルール

- 機能IDは親の id を `.` で連結したもの（例: `search.freeword.method.support_text`）。既存の機能IDは変更しない。
- テナント設定の `features` には ON にする任意機能（`toggle: optional`）だけを書く。書かれていない任意機能は OFF。必須機能は書かない。
- level2 機能（catalog の `children`）は親機能が ON のときだけ ON にできる。
- `optional_field` を持つ機能を ON にするテナントは、`optional_fields` にその項目名を定義する。
- 標準プロダクトで実現できない個別対応は `customizations` に書く。

## 新しいテナントを追加するとき

1. `spec/tenants/<id>.yaml` を作る（`id` はファイル名と一致させる）。既存テナントのファイルを参考にする。
2. 要件の各項目を catalog の機能に対応付ける。対応する機能がない要件は勝手に機能を作らず、`customizations` に書くか確認を求める。
3. `npm run build` を実行し、エラーがなくなるまで直す。

## コマンド

- `npm run validate` — 検証のみ
- `npm run build` — 検証と生成
