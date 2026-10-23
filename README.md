# setup-specification-sandbox

マルチテナントプロダクトのセットアップ仕様を、Excel（`setup.xlsx`）から YAML へ移行するサンプル。

```sh
npm install
npm run build        # 検証して dist/ を生成
open dist/index.html # 一覧ページ（テナント切り替え・差分のみ表示・検索）
```

- 仕様の書き方とルールは [CLAUDE.md](CLAUDE.md) を参照
- エディタで YAML のスキーマ補完を使うには VS Code の YAML 拡張（redhat.vscode-yaml）を入れる

## Excel からの対応

| Excel | YAML |
| --- | --- |
| A〜E列（ユーザー体験〜項目、補足） | `spec/catalog.yaml` の木構造 |
| F〜G列（on/off可否 level-1 / level2） | `toggle`、level2 は `children` |
| H〜I列（トレランス） | `constraints.functional` / `constraints.ui` |
| J列（必要なデータ） | `data`（任意項目は `optional_fields`） |
| テナント列のセットアップ | `spec/tenants/<id>.yaml` の `features` |
| 任意項目名・備考 | `optional_fields`、`features.<id>.note` |
| カスタマイズ | `customizations` |
