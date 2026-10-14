{{--
    Renders an admin-customised email (Settings → Email Templates) inside the
    standard layout. $customBody is sanitised on save and its placeholders are
    filled with HTML-escaped values by EmailTemplateEditor::fill().

    The layout places content inside a <table>, so a body written as table rows
    (the form the default Blade bodies take) is output as-is, and any other
    markup (paragraphs, lists) is wrapped in a single styled row.
--}}
@extends('emails.layouts.base')

@section('title', $customTitle)

@section('content')
@if (\Illuminate\Support\Str::startsWith(ltrim($customBody), '<tr'))
{!! $customBody !!}
@else
<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif; line-height:22px;">
        {!! $customBody !!}
    </td>
</tr>
@endif
@endsection
