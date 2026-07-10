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
    
    # Get all HQs and their BEs from employees table
    cursor.execute("""
        SELECT hq_name, ARRAY_AGG(emp_id ORDER BY emp_id) 
        FROM employees 
        WHERE designation = 'BE' 
        GROUP BY hq_name 
        HAVING COUNT(emp_id) > 1;
    """)
    hq_bes = cursor.fetchall()
    print("HQs with more than one BE in employees:")
    for hq, bes in hq_bes:
        print(f"HQ: {hq}, BEs: {bes}")
        
    print("-" * 50)
    
    # For each such HQ, check the stockist mapping
    for hq, bes in hq_bes:
        if not hq:
            continue
        cursor.execute("""
            SELECT DISTINCT be_emp_id_1, be_emp_id_2, be_emp_id_3 
            FROM stockist_mapping 
            WHERE hq_name = %s;
        """, (hq,))
        mappings = cursor.fetchall()
        print(f"HQ: {hq} has stockist mappings to BEs: {mappings}")
        
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)
