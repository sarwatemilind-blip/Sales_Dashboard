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
    
    # Check targets where emp_id is not in downline of ADLA02
    cursor.execute("""
        SELECT DISTINCT emp_id 
        FROM targets 
        WHERE year = 2026 AND month_num = 1 
          AND emp_id NOT IN (SELECT emp_id FROM downline('ADLA02'));
    """)
    rows = cursor.fetchall()
    print("Emp IDs in targets but not in downline of ADLA02:", rows)
    
    # Check targets where emp_id is not in employees table at all
    cursor.execute("""
        SELECT DISTINCT t.emp_id 
        FROM targets t
        LEFT JOIN employees e ON e.emp_id = t.emp_id
        WHERE e.emp_id IS NULL AND t.year = 2026 AND t.month_num = 1;
    """)
    rows = cursor.fetchall()
    print("Emp IDs in targets but not in employees table at all:", rows)
    
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)
