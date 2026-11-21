# Bible Shorts — 聖書を最初から英語で学ぶショート動画シリーズ

**管理の正本はこのリポジトリ**。創世記から黙示録までの聖句範囲・動画の制作順・英語学習・審査・公開状態を管理します。動画生成エンジンやYouTube認証情報はこのリポジトリに重複保存しません。

## 現在の初期データ

- プロテスタント66巻・1,189章の目録。基準となる英語の出典は66巻版 World English Bible (`engwebp`)。
- Genesis 1:1〜3:24を**欠番なし**で10話に分割。現状すべて `planned`（企画済み）で、制作・公開済みではありません。
- 採用済みの標準画風は `low-poly-3d`、制作は `nomuonji/animation-factory`。
- ダッシュボードはGitデータの**読み取り画面**。状態変更はCLI/PRでレビューして反映します。

## セットアップ

Node.js 22以上、追加パッケージ不要。

```sh
npm run check      # 巻順/節の欠番・配信ゲート/品質の確認 + ダッシュボード生成
npm run next       # 次の未制作回
npm run summary    # 現在の状態
npm run build      # dist/に静的管理画面を生成
python3 -m http.server 8080 --directory dist
```

ブラウザーで http://localhost:8080 を開く。PR CIの `bible-shorts-dashboard` artifact にも生成された管理画面が入ります。

## データ

| 保存先 | 役割 |
| --- | --- |
| `catalog/books.json` | 66巻・章数・検証済み章の節数 |
| `catalog/source.json` | WEBの版・引用/脚色の扱い |
| `episodes/EP001.json` 以降 | 聖句の担当範囲・学習目標・制作証拠・承認・予約・実際の公開結果 |
| `src/ledger.mjs` | 欠番/重複・承認・予約/公開順の強制 |
| `scripts/bible.mjs` | CLI操作と制作/配信メタデータの出力 |
| `web/` | レスポンシブの66巻・エピソード管理画面 |

## 公開までの状態遷移

```text
planned → scripted → rendered → qa_passed → approved → queued → published
```

`rendered` には本物の動画SHA256・制作rev・レビューURLが必要。`qa_passed` には英語・日本語・聖書の整合・字幕/音声など8項目のQA、`approved` には編集者の明示承認、`queued` には指定YouTubeチャンネルと実際の受付記録、`published` にはYouTubeの動画IDとreadbackが必要です。欠番投稿・後の回を先に予約・動画ID重複はエラーになります。

各段階は `node scripts/bible.mjs advance EP001 scripted --patch ./evidence.json --actor editor-id` で進める（証拠フィールド必須）。`node scripts/bible.mjs handoff EP001` でAnimation Factory用の参照JSON、`node scripts/bible.mjs publisher-sidecar EP001 --at 2026-12-01T12:00:00+09:00 --channel CHANNEL_ID` で**公開承認済みの回に限り、配信メタデータ**を出力します。これらは投稿を実行しません。

## 権利と網羅管理

原典：[World English Bible 66-book edition](https://ebible.org/engwebp/)。本文はパブリックドメインですが、作品用に脚色したセリフは**原文の直接引用と区別**すること（名称の商標にも注意）。日本語訳、画像、音声、音楽の権利は別に確認すること。

章の節数が未検証の場合、節単位で全巻網羅したとは**表示しません**。最初にGenesis 1–3の節数31/25/24を登録済みで、企画範囲と実際の公開範囲を別集計します。系図・律法も飛ばさず、必要に応じて概要解説形式で取り扱います。

## まだつないでいない機能

本MVPは**Git台帳＋CLI＋静的管理画面**です。My Portalへのナビゲーション、Animation Factoryへの自動ジョブ投入、Video Publisherへの予約送信、公開結果/Analytics自動回収は未接続。個別のチャンネル接続と明示的な公開許可なしに自動投稿を有効化しません。既存のChatGPT定期ジョブ枠も増やしません。

## スマホから管理画面を見る

GitHub Pagesを有効化する場合は、GitHubの **Settings → Pages → Build and deployment → Source: GitHub Actions** を一度選択してください。GitHub Appからの初回有効化は権限不足のため不可でした。その後 **Actions → Bible Shorts — Dashboard Pages → Run workflow** でデプロイできます。**台帳は読み取り専用**です。更新操作はレビュー済みGit PRを通します。

また、GitHub Actionsの `bible-shorts-dashboard` artifactを展開して `index.html` を開く方法なら、Pages設定前でもオフラインで閲覧できます。

詳しくは [docs/integrations.md](docs/integrations.md)、作業エージェントは [AGENTS.md](AGENTS.md) を参照。