import psycopg2

db_host = "aws-1-ap-south-1.pooler.supabase.com"
project_ref = "jxwazdpsnupjiogmxozn"
db_user = f"postgres.{project_ref}"
db_password = "Adonisgroma@2026"
db_name = "postgres"

try:
    conn = psycopg2.connect(
        host=db_host,
        database=db_name,
        user=db_user,
        password=db_password,
        port="5432",
        sslmode="require"
    )
    cursor = conn.cursor()
    
    # Sum of val_target_total grouped by HQ (taking max or distinct hq target)
    cursor.execute("""
        WITH hq_t AS (
            SELECT hq_name, MAX(val_target_total) as val_target
            FROM targets 
            WHERE year = 2026 AND month_num = 1
            GROUP BY hq_name
        )
        SELECT SUM(val_target) * 100000 FROM hq_t;
    """)
    print("Sum of unique HQ targets:", cursor.fetchone()[0])
    
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)
