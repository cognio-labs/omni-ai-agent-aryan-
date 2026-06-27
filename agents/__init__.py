"""
agents/__init__.py — Sub-agent registry helpers.
"""
from typing import Optional
from sqlalchemy.orm import Session
from models import Agent


def get_agent_by_id(db: Session, agent_id: int) -> Optional[Agent]:
    return db.query(Agent).filter(Agent.id == agent_id).first()


def list_agents(db: Session) -> list[Agent]:
    return db.query(Agent).order_by(Agent.created_at.desc()).all()


def create_agent(
    db: Session,
    name: str,
    description: str,
    system_prompt: str,
    model: str,
    config_json: str = "{}",
    temperature: float = 0.7,
    enable_search: bool = True,
    enable_db_query: bool = False,
    enable_code_gen: bool = True,
) -> Agent:
    agent = Agent(
        name=name,
        description=description,
        system_prompt=system_prompt,
        model=model,
        config_json=config_json,
        temperature=temperature,
        enable_search=enable_search,
        enable_db_query=enable_db_query,
        enable_code_gen=enable_code_gen,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent
