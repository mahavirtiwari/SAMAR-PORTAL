{{-- Shared page footer. The page number is written by the paginator script from the true page index. --}}
<div class="page-footer">
    <table>
        <tr>
            <td class="footer-application">{{ $application->application_number ?? 'N/A' }}</td>
            <td class="footer-page"><span class="page-number"></span></td>
        </tr>
    </table>
</div>
