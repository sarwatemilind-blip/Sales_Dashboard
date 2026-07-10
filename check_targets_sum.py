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
    
    # Check total targets for month 1
    cursor.execute("""
        SELECT SUM(val_target_per_be) * 100000 FROM targets WHERE year = 2026 AND month_num = 1;
    """)
    print("Total targets in targets table (month 1):", cursor.fetchone()[0])
    
    # Check total targets for month 1 in downline of ADLA02
    cursor.execute("""
        SELECT SUM(val_target_per_be) * 100000 FROM targets WHERE emp_id IN (SELECT emp_id FROM downline('ADLA02')) AND year = 2026 AND month_num = 1;
    """)
    print("Total targets in downline of ADLA02 (month 1):", cursor.fetchone()[0])
    
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)
