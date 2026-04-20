from fastapi import FastAPI, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.auth import get_current_user
from app.routes.folders import router as folder_router
from app.routes.files import router as file_router
from app.routes.directory import router as directory_router
from app.routes.shares import router as share_router

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="app/templates")

app.include_router(folder_router)
app.include_router(file_router)
app.include_router(directory_router)
app.include_router(share_router)


@app.get("/", response_class=HTMLResponse)
def root():
    return RedirectResponse(url="/login")


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/signup", response_class=HTMLResponse)
def signup_page(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})


@app.get("/app", response_class=HTMLResponse)
def app_page(request: Request):
    return templates.TemplateResponse("app.html", {"request": request})


@app.get("/test-db")
def test_db():
    from app.db import db
    return {
        "message": "MongoDB connection successful",
        "collections": db.list_collection_names()
    }


@app.get("/test-firebase")
def test_firebase():
    return {"message": "Firebase Admin initialized successfully"}


@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "uid": current_user.get("uid"),
        "email": current_user.get("email")
    }