const handleExportPDF = () => {
    try {
        setExportingPDF(true);

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPos = 20;

        // Define colors
        const colors = {
            primary: [41, 128, 185], // Blue
            success: [39, 174, 96], // Green
            warning: [243, 156, 18], // Orange
            danger: [231, 76, 60], // Red
            gray: [149, 165, 166], // Gray
            lightGray: [236, 240, 241],
            darkGray: [52, 73, 94]
        };

        // Helper function for status color
        const getStatusColor = (status) => {
            switch (status) {
                case 'approved': return colors.success;
                case 'submitted': return colors.warning;
                case 'rejected': return colors.danger;
                default: return colors.gray;
            }
        };

        // === HEADER SECTION ===
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.primary);
        doc.text('Timesheet Report', pageWidth / 2, yPos, { align: 'center' });

        yPos += 10;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(`${staffMember?.firstName || ''} ${staffMember?.lastName || ''}`, pageWidth / 2, yPos, { align: 'center' });

        yPos += 7;
        doc.setFontSize(10);
        doc.setTextColor(...colors.darkGray);
        const staffInfo = [
            staffMember?.username ? `@${staffMember.username}` : '',
            staffMember?.title || '',
            staffMember?.department || ''
        ].filter(Boolean).join('  |  ');
        doc.text(staffInfo, pageWidth / 2, yPos, { align: 'center' });

        yPos += 10;
        doc.setDrawColor(...colors.lightGray);
        doc.line(20, yPos, pageWidth - 20, yPos);
        yPos += 10;

        // === FILTER SUMMARY BOX ===
        doc.setFillColor(...colors.lightGray);
        doc.roundedRect(20, yPos, pageWidth - 40, 22, 2, 2, 'F');

        yPos += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.darkGray);
        doc.text('Filters Applied:', 25, yPos);

        yPos += 5;
        doc.setFont('helvetica', 'normal');
        const filterText = [
            appliedStartDate && appliedEndDate ? `Date Range: ${appliedStartDate} to ${appliedEndDate}` : 'Date Range: All',
            appliedStatus ? `Status: ${appliedStatus.toUpperCase()}` : 'Status: All',
            `View: ${accessType.charAt(0).toUpperCase() + accessType.slice(1)}`
        ].join('  |  ');
        doc.text(filterText, 25, yPos);

        yPos += 5;
        doc.setFontSize(8);
        doc.setTextColor(...colors.gray);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 25, yPos);

        yPos += 15;

        // === STATISTICS SECTION ===
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Summary Statistics', 20, yPos);
        yPos += 8;

        const stats = [
            { label: 'Total Timesheets', value: statistics?.totalTimesheets || 0 },
            { label: 'Total Hours', value: formatHours(statistics?.totalHours || 0) },
            { label: 'Avg Hours/Week', value: statistics?.averageHoursPerWeek || 0 },
            { label: 'Billable Hours', value: formatHours(statistics?.totalBillableHours || 0) }
        ];

        const statBoxWidth = (pageWidth - 50) / 4;
        stats.forEach((stat, index) => {
            const xPos = 20 + (index * statBoxWidth) + (index * 2.5);

            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(...colors.lightGray);
            doc.roundedRect(xPos, yPos, statBoxWidth, 18, 1, 1, 'FD');

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colors.primary);
            doc.text(String(stat.value), xPos + statBoxWidth / 2, yPos + 8, { align: 'center' });

            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colors.darkGray);
            doc.text(stat.label, xPos + statBoxWidth / 2, yPos + 14, { align: 'center' });
        });

        yPos += 25;

        // === TIMESHEETS SECTION ===
        if (timesheets.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(...colors.gray);
            doc.setFont('helvetica', 'italic');
            doc.text('No timesheets found for the selected filters', pageWidth / 2, yPos + 20, { align: 'center' });
        } else {
            timesheets.forEach((timesheet) => {
                // Check if we need a new page
                if (yPos > pageHeight - 60) {
                    doc.addPage();
                    yPos = 20;
                }

                // Timesheet header
                const weekStartDate = new Date(timesheet.weekStart);
                const weekEndDate = new Date(weekStartDate);
                weekEndDate.setDate(weekEndDate.getDate() + 6);

                doc.setFillColor(...getStatusColor(timesheet.status));
                doc.rect(20, yPos, pageWidth - 40, 10, 'F');

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text(
                    `Week: ${formatDate(timesheet.weekStart)} - ${formatDate(weekEndDate.toISOString())}`,
                    25,
                    yPos + 6.5
                );

                doc.text(
                    `Status: ${timesheet.status?.toUpperCase() || 'DRAFT'}`,
                    pageWidth / 2 + 10,
                    yPos + 6.5
                );

                doc.text(
                    `${formatHours(timesheet.totalHours)} hrs (${formatHours(timesheet.billableHours)} billable)`,
                    pageWidth - 25,
                    yPos + 6.5,
                    { align: 'right' }
                );

                yPos += 12;

                // Entries table
                if (timesheet.entries && timesheet.entries.length > 0) {
                    const tableData = timesheet.entries.map(entry => {
                        const workDate = new Date(entry.workDate);
                        const dayName = workDate.toLocaleDateString('en-US', { weekday: 'short' });

                        return [
                            `${formatDate(entry.workDate)}\n${dayName}`,
                            entry.projectName || '-',
                            entry.taskName || '-',
                            formatHours(entry.hours),
                            entry.billable ? '✓' : '✗',
                            entry.description || '-'
                        ];
                    });

                    doc.autoTable({
                        startY: yPos,
                        head: [['Date', 'Project', 'Task', 'Hours', 'Bill', 'Description']],
                        body: tableData,
                        theme: 'striped',
                        headStyles: {
                            fillColor: colors.darkGray,
                            textColor: [255, 255, 255],
                            fontSize: 8,
                            fontStyle: 'bold',
                            halign: 'left'
                        },
                        bodyStyles: {
                            fontSize: 8,
                            textColor: colors.darkGray
                        },
                        columnStyles: {
                            0: { cellWidth: 25, halign: 'left' },
                            1: { cellWidth: 45, halign: 'left' },
                            2: { cellWidth: 35, halign: 'left' },
                            3: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
                            4: { cellWidth: 12, halign: 'center' },
                            5: { cellWidth: 'auto', halign: 'left' }
                        },
                        alternateRowStyles: {
                            fillColor: [250, 250, 250]
                        },
                        margin: { left: 20, right: 20 },
                        didDrawPage: (data) => {
                            // Add footer on each page
                            const pageCount = doc.internal.getNumberOfPages();
                            const currentPage = doc.internal.getCurrentPageInfo().pageNumber;

                            doc.setFontSize(8);
                            doc.setTextColor(...colors.gray);
                            doc.text(
                                `Page ${currentPage} of ${pageCount}`,
                                pageWidth / 2,
                                pageHeight - 10,
                                { align: 'center' }
                            );
                        }
                    });

                    yPos = doc.lastAutoTable.finalY + 5;
                } else {
                    doc.setFontSize(9);
                    doc.setTextColor(...colors.gray);
                    doc.setFont('helvetica', 'italic');
                    doc.text('No entries for this timesheet', 25, yPos + 5);
                    yPos += 15;
                }

                yPos += 5;
            });
        }

        // Save PDF
        const fileName = `${staffMember?.firstName || 'staff'}-${staffMember?.lastName || ''}-timesheets${appliedStartDate ? `-from-${appliedStartDate}` : ''}${appliedEndDate ? `-to-${appliedEndDate}` : ''}.pdf`;
        doc.save(fileName);

        showToast('PDF exported successfully!', 'success');
    } catch (error) {
        console.error('PDF export error:', error);
        showToast('Failed to export PDF', 'danger');
    } finally {
        setExportingPDF(false);
    }
};
