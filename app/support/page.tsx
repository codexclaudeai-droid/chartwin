import { SupportPanel } from './support-panel';

export default function SupportPage() {
  return (
    <main className="page">
      <h1>고객센터</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Status</th>
            <th>Visibility</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>공지사항</td>
            <td>Admin managed</td>
            <td>Public</td>
          </tr>
          <tr>
            <td>1:1 문의</td>
            <td>Waiting / Answered</td>
            <td>Owner and admin</td>
          </tr>
          <tr>
            <td>FAQ</td>
            <td>Published</td>
            <td>Public</td>
          </tr>
        </tbody>
      </table>
      <SupportPanel />
    </main>
  );
}
