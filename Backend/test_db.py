from database import engine

try: 
    con = engine.connect()
    print("Database connected successfully.")
    con.close()
except Exception as ex:
    print("Database connection failed:", ex)