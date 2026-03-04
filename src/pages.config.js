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
import ArchivedRecords from './pages/ArchivedRecords';
import ClientPortal from './pages/ClientPortal';
import ContactDetail from './pages/ContactDetail';
import Contacts from './pages/Contacts';
import Contracts from './pages/Contracts';
import DJDetail from './pages/DJDetail';
import DJRoster from './pages/DJRoster';
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
import Payments from './pages/Payments';
import Quotes from './pages/Quotes';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import StaffMusicManager from './pages/StaffMusicManager';
import StaffPlanningHub from './pages/StaffPlanningHub';
import StaffPrint from './pages/StaffPrint';
import StaffSpecialSongsList from './pages/StaffSpecialSongsList';
import StaffTimelineManager from './pages/StaffTimelineManager';
import StaffTimelineView from './pages/StaffTimelineView';
import Tasks from './pages/Tasks';
import TimelineBuilder from './pages/TimelineBuilder';
import Venues from './pages/Venues';
import Users from './pages/Users';
import UserForm from './pages/UserForm';
import AcceptInvite from './pages/AcceptInvite';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ArchivedRecords": ArchivedRecords,
    "ClientPortal": ClientPortal,
    "ContactDetail": ContactDetail,
    "Contacts": Contacts,
    "Contracts": Contracts,
    "DJDetail": DJDetail,
    "DJRoster": DJRoster,
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
    "Payments": Payments,
    "Quotes": Quotes,
    "Reports": Reports,
    "Settings": Settings,
    "StaffMusicManager": StaffMusicManager,
    "StaffPlanningHub": StaffPlanningHub,
    "StaffPrint": StaffPrint,
    "StaffSpecialSongsList": StaffSpecialSongsList,
    "StaffTimelineManager": StaffTimelineManager,
    "StaffTimelineView": StaffTimelineView,
    "Tasks": Tasks,
    "TimelineBuilder": TimelineBuilder,
    "Venues": Venues,
    "Users": Users,
    "UserForm": UserForm,
    "AcceptInvite": AcceptInvite,
    "ForgotPassword": ForgotPassword,
    "ResetPassword": ResetPassword,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};