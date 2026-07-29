import asyncio
import logging

from app.db.session import engine
from app.db.base import Base
# Import all models so they are registered with Base.metadata
from app.models import all_models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_models():
    """
    Connects to the database and creates all tables defined in the models.
    """
    logger.info("Starting database initialization...")
    try:
        async with engine.begin() as conn:
            # create_all will create tables that don't exist
            await conn.run_sync(Base.metadata.create_all)
        logger.info("All tables created successfully!")
    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(init_models())
