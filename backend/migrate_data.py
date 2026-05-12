"""
Migrate data from Google Cloud SQL to Supabase
"""
import psycopg2
import psycopg2.extras
from urllib.parse import urlparse
import os

# Source: Google Cloud SQL
SOURCE_URL = "postgresql://postgres:San%40778090@34.14.158.102:5432/myappdb_clean"

# Target: Supabase (from .env)
TARGET_URL = "postgresql://postgres.gopedbpaquoonyxtrjhi:San%40ros1415@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

def parse_url(url):
    parsed = urlparse(url)
    return {
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'database': parsed.path[1:],
        'user': parsed.username,
        'password': parsed.password
    }

def get_connection(url, sslmode='prefer'):
    params = parse_url(url)
    return psycopg2.connect(
        host=params['host'],
        port=params['port'],
        database=params['database'],
        user=params['user'],
        password=params['password'],
        sslmode=sslmode
    )

def get_tables(conn):
    """Get all table names excluding Prisma migrations"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name != '_prisma_migrations'
            ORDER BY table_name
        """)
        return [row[0] for row in cur.fetchall()]

def clear_target_tables(target_conn, tables):
    """Clear data from target tables in reverse order (handle FK constraints)"""
    with target_conn.cursor() as cur:
        # Disable foreign key checks temporarily
        cur.execute("SET session_replication_role = 'replica';")
        
        for table in reversed(tables):
            print(f"Clearing table: {table}")
            cur.execute(f'TRUNCATE TABLE "{table}" CASCADE')
        
        target_conn.commit()
        cur.execute("SET session_replication_role = 'origin';")

def migrate_table(source_conn, target_conn, table):
    """Migrate data from one table"""
    with source_conn.cursor() as source_cur:
        # Get column names
        source_cur.execute(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table}'
            ORDER BY ordinal_position
        """)
        columns = [row[0] for row in source_cur.fetchall()]
        
        if not columns:
            print(f"  Skipping {table} (no columns)")
            return
        
        # Get row count
        source_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        count = source_cur.fetchone()[0]
        
        if count == 0:
            print(f"  {table}: 0 rows (skipped)")
            return
        
        print(f"  {table}: {count} rows...")
        
        # Fetch data in batches
        batch_size = 1000
        columns_str = ', '.join(f'"{c}"' for c in columns)
        placeholders = ', '.join(['%s'] * len(columns))
        
        with target_conn.cursor() as target_cur:
            source_cur.execute(f'SELECT {columns_str} FROM "{table}"')
            
            batch = []
            inserted = 0
            
            for row in source_cur:
                batch.append(row)
                
                if len(batch) >= batch_size:
                    psycopg2.extras.execute_values(
                        target_cur,
                        f'INSERT INTO "{table}" ({columns_str}) VALUES %s',
                        batch
                    )
                    target_conn.commit()
                    inserted += len(batch)
                    batch = []
                    print(f"    ...{inserted}/{count}")
            
            # Insert remaining rows
            if batch:
                psycopg2.extras.execute_values(
                    target_cur,
                    f'INSERT INTO "{table}" ({columns_str}) VALUES %s',
                    batch
                )
                target_conn.commit()
                inserted += len(batch)
        
        print(f"  ✓ {table}: {inserted} rows migrated")

def main():
    print("=" * 60)
    print("Google Cloud SQL → Supabase Migration")
    print("=" * 60)
    
    print("\nConnecting to Google Cloud SQL (source)...")
    source_conn = get_connection(SOURCE_URL, sslmode='prefer')
    print("✓ Connected to source")
    
    print("\nConnecting to Supabase (target)...")
    target_conn = get_connection(TARGET_URL, sslmode='require')
    print("✓ Connected to target")
    
    print("\nGetting table list...")
    tables = get_tables(source_conn)
    print(f"Found {len(tables)} tables: {', '.join(tables)}")
    
    print("\nClearing target tables...")
    clear_target_tables(target_conn, tables)
    
    print("\nMigrating data...")
    for table in tables:
        migrate_table(source_conn, target_conn, table)
    
    print("\n" + "=" * 60)
    print("Migration complete!")
    print("=" * 60)
    
    source_conn.close()
    target_conn.close()

if __name__ == "__main__":
    main()
