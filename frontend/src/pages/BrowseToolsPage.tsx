import { useSearchParams } from 'react-router-dom';
import AvailableToolsPage from './AvailableToolsPage';
import ReturnedToolsPage from './ReturnedToolsPage';
// R1 QA note: Browse Tools page is part of the frontend mock review workflow.
/**
 * BrowseToolsPage
 *
 * This is now a small wrapper page.
 *
 * Purpose:
 * - Keeps AppRoutes simple by using /tools for Browse Tools.
 * - Decides which sub-page to show based on the URL query parameter.
 *
 * URL behavior:
 * - /tools shows AvailableToolsPage.
 * - /tools?view=returned shows ReturnedToolsPage.
 *
 * Add New Tool:
 * - /tools/new is still handled by CreateToolPage in AppRoutes.
 */
function BrowseToolsPage() {
  const [searchParams] = useSearchParams();

  const view = searchParams.get('view');

  if (view === 'returned') {
    return <ReturnedToolsPage />;
  }

  return <AvailableToolsPage />;
}

export default BrowseToolsPage;
