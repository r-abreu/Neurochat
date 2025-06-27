const fs = require('fs');
const path = require('path');

const TICKETS_FILE = path.join(__dirname, '../data/tickets.json');
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Save tickets to file
function saveTickets(tickets) {
  try {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
    console.log(`💾 Saved ${tickets.length} tickets to persistent storage`);
  } catch (error) {
    console.error('Error saving tickets:', error);
  }
}

// Load tickets from file
function loadTickets() {
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      const data = fs.readFileSync(TICKETS_FILE, 'utf8');
      const tickets = JSON.parse(data);
      console.log(`📁 Loaded ${tickets.length} tickets from persistent storage`);
      return tickets;
    }
    return [];
  } catch (error) {
    console.error('Error loading tickets:', error);
    return [];
  }
}

// Auto-save tickets periodically (every 30 seconds)
function startAutoSave(getTickets) {
  setInterval(() => {
    const tickets = getTickets();
    if (tickets && tickets.length > 0) {
      saveTickets(tickets);
    }
  }, 30 * 1000);
}

// Save on process exit
function setupExitHandlers(getTickets) {
  const saveOnExit = () => {
    console.log('\n🔄 Saving tickets before exit...');
    const tickets = getTickets();
    if (tickets && tickets.length > 0) {
      saveTickets(tickets);
    }
  };

  process.on('SIGINT', () => {
    saveOnExit();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    saveOnExit();
    process.exit(0);
  });
}

module.exports = {
  saveTickets,
  loadTickets,
  startAutoSave,
  setupExitHandlers
}; 