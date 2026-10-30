// Cada prueba empieza sin preferencias guardadas: el idioma o el tema que deja una prueba en el
// almacenamiento del navegador no debe cambiar el resultado de otra (el orden varía en el CI).
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
