/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadForm from './pages/LeadForm';
import LeadDetail from './pages/LeadDetail';
import Events from './pages/Events';
import EventForm from './pages/EventForm';
import EventDetail from './pages/EventDetail';
import Contacts from './pages/Contacts';
import Tasks from './pages/Tasks';
import Venues from './pages/Venues';
import Payments from './pages/Payments';
import MusicPlanner from './pages/MusicPlanner';
import TimelineBuilder from './pages/TimelineBuilder';
import Reports from './pages/Reports';
import DJView from './pages/DJView';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Leads": Leads,
    "LeadForm": LeadForm,
    "LeadDetail": LeadDetail,
    "Events": Events,
    "EventForm": EventForm,
    "EventDetail": EventDetail,
    "Contacts": Contacts,
    "Tasks": Tasks,
    "Venues": Venues,
    "Payments": Payments,
    "MusicPlanner": MusicPlanner,
    "TimelineBuilder": TimelineBuilder,
    "Reports": Reports,
    "DJView": DJView,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};