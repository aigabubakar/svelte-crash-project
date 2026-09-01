<script>
  import { onMount } from 'svelte';
  import { slide, fade } from 'svelte/transition';

  let todos = [];
  let newTodoTitle = '';
  let newTodoDate = '';
  let page = 1;
  let hasMore = true;
  let isDarkMode = false;
  
  const API_URL = 'http://localhost:3000/api/todos';

  onMount(async () => {
    // Check local storage for theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      isDarkMode = true;
      document.body.setAttribute('data-bs-theme', 'dark');
    }
    await fetchTodos(true);
  });

  async function fetchTodos(reset = false) {
    if (reset) {
      page = 1;
      hasMore = true;
    }
    try {
      const res = await fetch(`${API_URL}?page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        if (data.length < 10) hasMore = false;
        
        if (reset) {
          todos = data;
        } else {
          todos = [...todos, ...data];
        }
      }
    } catch (err) {
      console.error('Error fetching todos:', err);
    }
  }

  function loadMore() {
    page++;
    fetchTodos();
  }

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    const theme = isDarkMode ? 'dark' : 'light';
    document.body.setAttribute('data-bs-theme', theme);
    localStorage.setItem('theme', theme);
  }

  async function addTodo(e) {
    if (e) e.preventDefault();
    if (!newTodoTitle.trim()) return;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodoTitle, due_date: newTodoDate || null })
      });
      if (res.ok) {
        const newTodo = await res.json();
        todos = [newTodo, ...todos];
        newTodoTitle = '';
        newTodoDate = '';
      }
    } catch (err) {
      console.error('Error adding todo:', err);
    }
  }

  let progressTimers = {};
  
  function updateProgress(todo, event) {
    const newProgress = parseInt(event.target.value, 10);
    todo.progress = newProgress;
    todos = [...todos]; // Optimistic UI update
    
    // Debounce the API call
    if (progressTimers[todo.id]) clearTimeout(progressTimers[todo.id]);
    
    progressTimers[todo.id] = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/${todo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress: newProgress })
        });
        if (!res.ok) {
           console.error("Failed to update on server");
        }
      } catch (err) {
        console.error('Error updating progress:', err);
      }
    }, 500);
  }

  async function deleteTodo(id) {
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        todos = todos.filter(t => t.id !== id);
      }
    } catch (err) {
      console.error('Error deleting todo:', err);
    }
  }
</script>

<main class="container mt-5">
  <div class="row justify-content-center">
    <div class="col-md-8 col-lg-6">
      <div class="d-flex justify-content-end mb-3">
         <button class="btn btn-outline-secondary" onclick={toggleDarkMode}>
           {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
         </button>
      </div>
      <div class="card shadow-sm border-0">
        <div class="card-body">
          <h1 class="card-title text-center mb-4 text-primary fw-bold">My Tasks</h1>
          
          <form onsubmit={addTodo} class="mb-4">
            <div class="input-group mb-2">
              <input 
                type="text" 
                class="form-control form-control-lg" 
                placeholder="What needs to be done?" 
                bind:value={newTodoTitle} 
              />
              <span class="input-group-text bg-white text-muted">Expected Completion:</span>
              <input 
                type="date" 
                class="form-control form-control-lg" 
                style="max-width: 180px;"
                bind:value={newTodoDate} 
                title="Expected completion date"
              />
              <button class="btn btn-primary btn-lg px-4" type="submit">
                Add
              </button>
            </div>
          </form>

          <ul class="list-group list-group-flush">
            {#each todos as todo (todo.id)}
              <li class="list-group-item d-flex justify-content-between align-items-center border-bottom-0 mb-2 rounded {isDarkMode ? 'bg-dark border border-secondary' : 'bg-light'}" transition:slide>
                <div class="d-flex align-items-center w-100 me-3">
                  <div class="d-flex flex-column me-3" style="width: 120px;">
                    <label class="form-label small fw-bold mb-0" style="color: hsl({(todo.progress || 0) * 1.2}, 100%, 45%);">
                      {todo.progress || 0}% Done
                    </label>
                    <input 
                      type="range" 
                      class="form-range" 
                      min="0" max="100" step="5"
                      value={todo.progress || 0}
                      onchange={(e) => updateProgress(todo, e)}
                      style="accent-color: hsl({(todo.progress || 0) * 1.2}, 100%, 45%);"
                    />
                  </div>
                  <div>
                    <span class="fs-5 {(todo.progress === 100 || todo.completed) ? 'text-decoration-line-through text-muted' : ''}">
                      {todo.title}
                    </span>
                    <div class="small text-muted mt-1">
                      {#if todo.created_at}
                        <strong>Added:</strong> {new Date(todo.created_at).toLocaleDateString()}
                      {/if}
                      {#if todo.due_date}
                        <span class="ms-3">
                          <strong>Expected Completion:</strong> <span class="fw-bold text-primary">{new Date(todo.due_date).toLocaleDateString()}</span>
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
                <button class="btn btn-outline-danger btn-sm" onclick={() => deleteTodo(todo.id)}>
                  Delete
                </button>
              </li>
            {/each}
            {#if todos.length === 0}
              <li class="list-group-item text-center text-muted border-0 bg-transparent" transition:fade>
                No tasks yet. Enjoy your day!
              </li>
            {/if}
          </ul>
          {#if hasMore && todos.length > 0}
            <div class="text-center mt-3">
              <button class="btn btn-outline-primary" onclick={loadMore}>
                Load More
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</main>

<style>
  /* Extra custom styles if needed beyond bootstrap */
  .list-group-item {
    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  }
  .list-group-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
  :global(body[data-bs-theme="light"]) {
    background-color: #f8f9fa;
  }
  :global(body[data-bs-theme="dark"]) {
    background-color: #121212;
  }
</style>
