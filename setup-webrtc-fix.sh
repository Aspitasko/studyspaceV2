#!/bin/bash

# WebRTC Study Room Fix - Setup Script
# This script helps you apply the WebRTC fixes to your study room feature

echo "================================================"
echo "   WebRTC Study Room Fix - Setup Script"
echo "================================================"
echo ""

# Check if Supabase CLI is installed
if command -v supabase &> /dev/null; then
    echo "✓ Supabase CLI found"
    echo ""
    echo "Would you like to apply the database migration automatically? (y/n)"
    read -r apply_migration
    
    if [ "$apply_migration" = "y" ]; then
        echo "Applying migration..."
        supabase db push
        echo "✓ Migration applied"
    else
        echo "⚠ Skipping automatic migration"
        echo "  Please run the SQL in migrate-webrtc.sql manually in Supabase Dashboard"
    fi
else
    echo "⚠ Supabase CLI not found"
    echo ""
    echo "Please apply the database migration manually:"
    echo "1. Open your Supabase Dashboard"
    echo "2. Go to SQL Editor"
    echo "3. Copy and paste the contents of migrate-webrtc.sql"
    echo "4. Click 'Run'"
fi

echo ""
echo "================================================"
echo "   Next Steps"
echo "================================================"
echo ""
echo "1. Make sure the database migration is applied"
echo "2. Start your development server: npm run dev"
echo "3. Test with two browsers:"
echo "   - Create a room in one browser"
echo "   - Join with the code in another browser"
echo "4. You should see video/audio from both users"
echo ""
echo "For detailed information, see WEBRTC_FIX_README.md"
echo ""
echo "================================================"
echo "   Troubleshooting"
echo "================================================"
echo ""
echo "If you encounter issues:"
echo "• Check browser console for errors"
echo "• Verify camera/microphone permissions"
echo "• Try different browsers (Chrome, Firefox)"
echo "• Check Supabase realtime is enabled for:"
echo "  - webrtc_signals"
echo "  - room_participants"
echo "  - room_chat_messages"
echo "  - study_rooms"
echo ""
echo "Done! 🎉"
