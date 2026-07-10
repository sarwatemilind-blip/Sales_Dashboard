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
    
    # 1. Search targets for hq_name with "mald"
    cursor.execute("SELECT DISTINCT hq_code, hq_name FROM targets WHERE hq_name ILIKE '%mald%';")
    print("Targets matching mald:", cursor.fetchall())
    
    # 2. Search employees for hq_name with "mald"
    cursor.execute("SELECT DISTINCT hq_code, hq_name FROM employees WHERE hq_name ILIKE '%mald%';")
    print("Employees matching mald:", cursor.fetchall())
    
    # 3. Search stockist_mapping for hq_name with "mald"
    cursor.execute("SELECT DISTINCT hq_code, hq_name FROM stockist_mapping WHERE hq_name ILIKE '%mald%';")
    print("Stockist mapping matching mald:", cursor.fetchall())
    
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)
