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
import ClientPortal from './pages/ClientPortal';
import Contacts from './pages/Contacts';
import DJView from './pages/DJView';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import EventForm from './pages/EventForm';
import Events from './pages/Events';
import LeadDetail from './pages/LeadDetail';
import LeadForm from './pages/LeadForm';
import Leads from './pages/Leads';
import MusicPlanner from './pages/MusicPlanner';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Tasks from './pages/Tasks';
import TimelineBuilder from './pages/TimelineBuilder';
import Venues from './pages/Venues';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ClientPortal": ClientPortal,
    "Contacts": Contacts,
    "DJView": DJView,
    "Dashboard": Dashboard,
    "EventDetail": EventDetail,
    "EventForm": EventForm,
    "Events": Events,
    "LeadDetail": LeadDetail,
    "LeadForm": LeadForm,
    "Leads": Leads,
    "MusicPlanner": MusicPlanner,
    "Payments": Payments,
    "Reports": Reports,
    "Settings": Settings,
    "Tasks": Tasks,
    "TimelineBuilder": TimelineBuilder,
    "Venues": Venues,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};