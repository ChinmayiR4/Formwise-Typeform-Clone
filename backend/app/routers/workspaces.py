from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Form, Workspace
from ..schemas import MeOut, WorkspaceIn, WorkspaceOut
from ..services.forms import default_user

router = APIRouter(prefix="/api", tags=["workspace"])


@router.get("/me", response_model=MeOut)
def me(db: Session = Depends(get_db)):
    return default_user(db)


def _out(db: Session, ws: Workspace) -> WorkspaceOut:
    n = db.scalar(select(func.count(Form.id)).where(Form.workspace_id == ws.id)) or 0
    return WorkspaceOut(id=ws.id, name=ws.name, form_count=n)


@router.get("/workspaces", response_model=list[WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db)):
    user = default_user(db)
    rows = db.scalars(select(Workspace).where(Workspace.owner_id == user.id).order_by(Workspace.id)).all()
    return [_out(db, w) for w in rows]


@router.post("/workspaces", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
def create_workspace(body: WorkspaceIn, db: Session = Depends(get_db)):
    ws = Workspace(owner_id=default_user(db).id, name=body.name.strip())
    db.add(ws)
    db.commit()
    return _out(db, ws)


@router.patch("/workspaces/{ws_id}", response_model=WorkspaceOut)
def rename_workspace(ws_id: int, body: WorkspaceIn, db: Session = Depends(get_db)):
    ws = db.get(Workspace, ws_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    ws.name = body.name.strip()
    db.commit()
    return _out(db, ws)


@router.delete("/workspaces/{ws_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(ws_id: int, db: Session = Depends(get_db)):
    ws = db.get(Workspace, ws_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    count = db.scalar(select(func.count(Workspace.id)).where(Workspace.owner_id == ws.owner_id)) or 0
    if count <= 1:
        raise HTTPException(409, "You need at least one workspace")
    db.delete(ws)
    db.commit()
