{{--
    Usage: @include('emails.components.info-table', ['items' => [
        ['label' => 'SAMAR ID:', 'value' => $samar_id],
        ['label' => 'Email:', 'value' => $email],
    ]])
--}}

<tr>
    <td style="font-size:14px; font-family:Inter, sans-serif; line-height:24px;">

        <table cellpadding="0" cellspacing="0" border="0" style="font-family:Inter, sans-serif;">

            @foreach($items as $item)
            <tr>
                <td style="color:#78829D; font-weight:500; padding-right:16px; @if(!$loop->first) padding-top:4px; @endif {{ isset($item['label_width']) ? 'width:' . $item['label_width'] : 'width:144px' }}">
                    {{ $item['label'] }}
                </td>
                <td style="color:#252F4A; font-weight:500; @if(!$loop->first) padding-top:4px; @endif">
                    @if(isset($item['is_link']) && $item['is_link'])
                        <a href="{{ $item['value'] }}" style="color:#1B84FF; text-decoration:none;">
                            {{ $item['value'] }}
                        </a>
                    @else
                        {{ $item['value'] }}
                    @endif
                </td>
            </tr>
            @endforeach

        </table>

    </td>
</tr>
