from sqlalchemy import Column, String, BigInteger, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)  # Discord User ID
    username = Column(String, nullable=False)
    discriminator = Column(String, nullable=True) # Nullable as Discord is removing them
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    authorized_guilds = relationship("AuthorizedUser", back_populates="user")

class Guild(Base):
    __tablename__ = "guilds"

    id = Column(BigInteger, primary_key=True, index=True)  # Discord Guild ID
    name = Column(String, nullable=False)
    icon_url = Column(String, nullable=True)
    owner_id = Column(BigInteger, nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    authorized_users = relationship("AuthorizedUser", back_populates="guild")

class PermissionLevel(enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    USER = "user"

class AuthorizedUser(Base):
    __tablename__ = "authorized_users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    guild_id = Column(BigInteger, ForeignKey("guilds.id"), nullable=False)
    permission_level = Column(SQLEnum(PermissionLevel), default=PermissionLevel.USER)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(BigInteger, nullable=True) # User ID who granted permission

    user = relationship("User", back_populates="authorized_guilds")
    guild = relationship("Guild", back_populates="authorized_users")
