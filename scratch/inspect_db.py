import sqlite3

con = sqlite3.connect('backend/studyos.db')
cur = con.cursor()
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Tables:", tables)

for t in tables:
    count = cur.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
    print(f"Table '{t}': {count} rows")

cur.execute("SELECT id, email, full_name, is_active, is_verified FROM users")
users = cur.fetchall()
print("Users:", users)
