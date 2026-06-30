"""
models.py — SQLAlchemy ORM models for OmniClient.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime,
    ForeignKey, Boolean
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, default="New Conversation")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    message_count = Column(Integer, default=0)
    pinned = Column(Boolean, default=False)
    archived = Column(Boolean, default=False)

    messages = relationship(
        "Message", back_populates="conversation",
        cascade="all, delete-orphan"
    )
    memories = relationship(
        "Memory", back_populates="conversation",
        cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer, ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    role = Column(String(20), nullable=False)  # 'user' | 'assistant' | 'system'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    metadata_json = Column(Text, default="{}")
    bookmarked = Column(Boolean, default=False)

    conversation = relationship("Conversation", back_populates="messages")


class Memory(Base):
    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer, ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    key = Column(String(255), nullable=False)
    value = Column(Text, nullable=False)
    importance_score = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="memories")


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    system_prompt = Column(Text, nullable=False)
    model = Column(String(100), default="cohere/north-mini-code:free")
    created_at = Column(DateTime, default=datetime.utcnow)
    config_json = Column(Text, default="{}")
    temperature = Column(Float, default=0.7)
    enable_search = Column(Boolean, default=True)
    enable_db_query = Column(Boolean, default=False)
    enable_code_gen = Column(Boolean, default=True)


class SearchCache(Base):
    __tablename__ = "search_cache"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String(500), nullable=False, index=True)
    results_json = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)


class Presentation(Base):
    __tablename__ = "presentations"

    id              = Column(Integer, primary_key=True, index=True)
    title           = Column(String(255), nullable=False)
    topic           = Column(Text, nullable=False, default="")
    template        = Column(String(100), default="Bold Blue")
    slide_count     = Column(Integer, default=10)
    file_path       = Column(String(500), default="")
    slides_json     = Column(Text, default="[]")   # JSON array of slide objects
    status          = Column(String(30), default="completed")  # generating/completed/failed
    conversation_id = Column(
        Integer, ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    created_at      = Column(DateTime, default=datetime.utcnow)


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), nullable=False, unique=True) # "gmail", "slack", "n8n", "whatsapp"
    tokens_json = Column(Text, nullable=False) # encrypted tokens
    connected_at = Column(DateTime, default=datetime.utcnow)


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_key = Column(String(100), nullable=False, unique=True, default="default")
    plan = Column(String(50), nullable=False, default="Free")
    status = Column(String(50), nullable=False, default="active")
    stripe_customer_id = Column(String(255), default="")
    stripe_subscription_id = Column(String(255), default="")
    current_period_end = Column(DateTime, nullable=True)
    monthly_message_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
