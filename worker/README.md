# Сервер синхронизации (Cloudflare Worker)

Нужен, чтобы **любой** мог добавлять и править лоты с сайта, а **удалять** можно было только по паролю.
Токен GitHub и пароль живут только в секретах воркера. На сайте и в репозитории их нет.

## Установка (один раз, ~5 минут, бесплатно)

1. **Токен GitHub.** https://github.com/settings/personal-access-tokens/new
   - Token name: `sticker-sync`, Expiration: максимальный срок
   - Repository access → **Only select repositories** → `sticker`
   - Permissions → Repository permissions → **Contents: Read and write**
   - Generate token → скопировать (`github_pat_…`)
2. **Воркер.** https://dash.cloudflare.com → зарегистрироваться → **Workers & Pages** → **Create** →
   **Create Worker** → имя `sticker-sync` → **Deploy** → **Edit code** →
   стереть всё, вставить содержимое `worker/sync-worker.js` → **Deploy**.
3. **Секреты.** В воркере: **Settings → Variables and Secrets → Add**:
   - Type **Secret**, name `GH_TOKEN`, value: токен из шага 1
   - Type **Secret**, name `DELETE_PASSWORD`, value: пароль на удаление
4. **Адрес.** Скопировать адрес воркера (`https://sticker-sync.<имя>.workers.dev`) и вписать в
   `data/site.json` → `{"api": "https://sticker-sync.<имя>.workers.dev"}` (на GitHub: открыть файл → ✎ → Commit).
   Через пару минут сайт у всех начнёт работать через сервер.

Проверка: открыть адрес воркера + `/lots` в браузере, должна показаться база в JSON.

## Что умеет
| Запрос | Кто может |
|---|---|
| `GET /lots`: прочитать базу | все |
| `POST /lots {lots}`: добавить/изменить | все (только с сайта) |
| `POST /lots {delete, password}`: удалить | только с паролем |
| `POST /lots {deleteAll, password}`: очистить | только с паролем |

Удалённые паролем лоты нельзя «воскресить» без пароля. Вся история изменений видна в коммитах ветки `gh-pages`,
так что любой лот можно восстановить оттуда.
