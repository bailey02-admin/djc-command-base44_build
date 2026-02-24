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
import DJView from './pages/DJView';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import EventForm from './pages/EventForm';
import Events from './pages/Events';
import FinalizerQueue from './pages/FinalizerQueue';
import LeadDetail from './pages/LeadDetail';
import LeadForm from './pages/LeadForm';
import Leads from './pages/Leads';
import MessageTemplates from './pages/MessageTemplates';
import MusicPlanner from './pages/MusicPlanner';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import TimelineBuilder from './pages/TimelineBuilder';
import ContactDetail from './pages/ContactDetail';
import DJDetail from './pages/DJDetail';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ClientPortal": ClientPortal,
    "DJView": DJView,
    "Dashboard": Dashboard,
    "EventDetail": EventDetail,
    "EventForm": EventForm,
    "Events": Events,
    "FinalizerQueue": FinalizerQueue,
    "LeadDetail": LeadDetail,
    "LeadForm": LeadForm,
    "Leads": Leads,
    "MessageTemplates": MessageTemplates,
    "MusicPlanner": MusicPlanner,
    "Reports": Reports,
    "Settings": Settings,
    "TimelineBuilder": TimelineBuilder,
    "ContactDetail": ContactDetail,
    "DJDetail": DJDetail,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};