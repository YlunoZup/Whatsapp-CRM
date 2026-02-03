import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ContactsService, LEAD_STATUSES, LeadStatus } from './contacts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import {
  BulkContactIdsDto,
  BulkAddTagsDto,
  BulkRemoveTagsDto,
  BulkAssignSessionDto,
  BulkEditDto,
} from './dto/bulk-operations.dto';
import { AddTagsDto } from './dto/add-tags.dto';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all contacts' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tagIds', required: false, isArray: true })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by lead status' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('tagIds') tagIds?: string[],
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.contactsService.findAll(user.tenantId, {
      search,
      tagIds,
      status,
      page,
      limit,
    });
  }

  // NOTE: Non-parameterized routes MUST come before @Get(':id') to avoid routing conflicts
  @Get('export')
  @ApiOperation({ summary: 'Export contacts to CSV' })
  async exportContacts(@CurrentUser() user: AuthenticatedUser) {
    return this.contactsService.exportToCsv(user.tenantId, user.id);
  }

  @Get('status-counts')
  @ApiOperation({ summary: 'Get count of contacts by lead status' })
  async getStatusCounts(@CurrentUser() user: AuthenticatedUser) {
    return this.contactsService.getStatusCounts(user.tenantId);
  }

  @Get('lead-statuses')
  @ApiOperation({ summary: 'Get available lead statuses' })
  getLeadStatuses() {
    return {
      statuses: Object.values(LEAD_STATUSES),
      labels: {
        [LEAD_STATUSES.NEW]: 'New',
        [LEAD_STATUSES.CONTACTED]: 'Contacted',
        [LEAD_STATUSES.INTERESTED]: 'Interested',
        [LEAD_STATUSES.NOT_INTERESTED]: 'Not Interested',
        [LEAD_STATUSES.CLOSED_WON]: 'Closed Won',
        [LEAD_STATUSES.CLOSED_LOST]: 'Closed Lost',
      },
    };
  }

  @Get('by-session/:sessionId')
  @ApiOperation({ summary: 'Get all contacts assigned to a specific session' })
  async getContactsBySession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.getContactsBySession(sessionId, user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a contact by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contactsService.findOne(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new contact' })
  async create(@Body() dto: CreateContactDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contactsService.create(user.tenantId, dto, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contact' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.update(id, user.tenantId, dto, user.id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update contact lead status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: LeadStatus },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.updateContactStatus(id, user.tenantId, body.status, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contact' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contactsService.delete(id, user.tenantId, user.id);
  }

  @Post(':id/tags')
  @ApiOperation({ summary: 'Add tags to a contact' })
  async addTags(
    @Param('id') id: string,
    @Body() dto: AddTagsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.addTags(id, user.tenantId, dto.tagIds);
  }

  @Delete(':id/tags')
  @ApiOperation({ summary: 'Remove tags from a contact' })
  async removeTags(
    @Param('id') id: string,
    @Body() dto: AddTagsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.removeTags(id, user.tenantId, dto.tagIds);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import contacts from CSV file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 imports per minute (resource intensive)
  async importContacts(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Body('phoneColumn') phoneColumn: string,
    @Body('nameColumn') nameColumn?: string,
    @Body('emailColumn') emailColumn?: string,
    // Extended metadata fields
    @Body('companyColumn') companyColumn?: string,
    @Body('jobTitleColumn') jobTitleColumn?: string,
    @Body('websiteColumn') websiteColumn?: string,
    @Body('addressColumn') addressColumn?: string,
    @Body('cityColumn') cityColumn?: string,
    @Body('countryColumn') countryColumn?: string,
    @Body('sourceColumn') sourceColumn?: string,
    @Body('notesColumn') notesColumn?: string,
    // Import options
    @Body('importMode') importMode?: string,
    @Body('skipEmptyValues') skipEmptyValues?: string,
    @Body('tagIds') tagIds?: string,
    @Body('sessionId') sessionId?: string,
  ) {
    return this.contactsService.importFromCsv(user.tenantId, file.buffer, {
      phoneColumn: parseInt(phoneColumn, 10),
      nameColumn: nameColumn ? parseInt(nameColumn, 10) : undefined,
      emailColumn: emailColumn ? parseInt(emailColumn, 10) : undefined,
      // Extended metadata fields
      companyColumn: companyColumn ? parseInt(companyColumn, 10) : undefined,
      jobTitleColumn: jobTitleColumn ? parseInt(jobTitleColumn, 10) : undefined,
      websiteColumn: websiteColumn ? parseInt(websiteColumn, 10) : undefined,
      addressColumn: addressColumn ? parseInt(addressColumn, 10) : undefined,
      cityColumn: cityColumn ? parseInt(cityColumn, 10) : undefined,
      countryColumn: countryColumn ? parseInt(countryColumn, 10) : undefined,
      sourceColumn: sourceColumn ? parseInt(sourceColumn, 10) : undefined,
      notesColumn: notesColumn ? parseInt(notesColumn, 10) : undefined,
      // Import options
      importMode: (importMode as 'create' | 'update' | 'createOrUpdate') || 'createOrUpdate',
      skipEmptyValues: skipEmptyValues === 'true',
      tagIds: tagIds ? JSON.parse(tagIds) : undefined,
      sessionId: sessionId || undefined,
    }, user.id);
  }

  // ============================================
  // BULK ACTION ENDPOINTS
  // ============================================

  @Post('bulk/add-tags')
  @ApiOperation({ summary: 'Add tags to multiple contacts (max 500 contacts, 50 tags)' })
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 bulk operations per minute
  async bulkAddTags(
    @Body() body: BulkAddTagsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.bulkAddTags(user.tenantId, body.contactIds, body.tagIds, user.id);
  }

  @Post('bulk/remove-tags')
  @ApiOperation({ summary: 'Remove tags from multiple contacts (max 500 contacts, 50 tags)' })
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 bulk operations per minute
  async bulkRemoveTags(
    @Body() body: BulkRemoveTagsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.bulkRemoveTags(user.tenantId, body.contactIds, body.tagIds, user.id);
  }

  @Post('bulk/assign-session')
  @ApiOperation({ summary: 'Assign multiple contacts to a session (max 500 contacts)' })
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 bulk operations per minute
  async bulkAssignSession(
    @Body() body: BulkAssignSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.bulkAssignSession(user.tenantId, body.contactIds, body.sessionId, user.id);
  }

  @Post('bulk/delete')
  @ApiOperation({ summary: 'Delete multiple contacts (max 500 contacts)' })
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 bulk deletes per minute (destructive)
  async bulkDelete(
    @Body() body: BulkContactIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.bulkDelete(user.tenantId, body.contactIds, user.id);
  }

  @Post('bulk/export')
  @ApiOperation({ summary: 'Export selected contacts to CSV (max 500 contacts)' })
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 exports per minute
  async bulkExport(
    @Body() body: BulkContactIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.exportSelectedToCsv(user.tenantId, body.contactIds, user.id);
  }

  @Post('bulk/edit')
  @ApiOperation({ summary: 'Bulk edit multiple contacts with the same values' })
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 bulk edits per minute
  async bulkEdit(
    @Body() body: {
      contactIds: string[];
      updates: {
        name?: string;
        email?: string;
        metadata?: Record<string, unknown>;
      };
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.bulkEdit(user.tenantId, body.contactIds, body.updates, user.id);
  }

  @Post('bulk/merge')
  @ApiOperation({ summary: 'Merge multiple contacts into a master record (max 10)' })
  async mergeContacts(
    @Body() body: { masterContactId: string; mergeContactIds: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.mergeContacts(
      user.tenantId,
      body.masterContactId,
      body.mergeContactIds,
      user.id,
    );
  }

  @Post('bulk/find-duplicates')
  @ApiOperation({ summary: 'Get details of selected contacts for merge preview' })
  async findDuplicates(
    @Body() body: { contactIds: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.findDuplicates(user.tenantId, body.contactIds);
  }

  @Post('bulk/update-status')
  @ApiOperation({ summary: 'Update lead status for multiple contacts' })
  async bulkUpdateStatus(
    @Body() body: { contactIds: string[]; status: LeadStatus },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.bulkUpdateStatus(user.tenantId, body.contactIds, body.status, user.id);
  }

  // ============================================
  // SESSION BINDING ENDPOINTS
  // ============================================

  @Get(':id/session-conflict/:sessionId')
  @ApiOperation({ summary: 'Check if messaging from a session would cause a conflict' })
  async checkSessionConflict(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.checkSessionConflict(id, sessionId, user.tenantId);
  }

  @Post(':id/assign-session')
  @ApiOperation({ summary: 'Assign a contact to a specific session (for session binding)' })
  async assignToSession(
    @Param('id') id: string,
    @Body() body: { sessionId: string; force?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.assignToSession(
      id,
      body.sessionId,
      user.tenantId,
      body.force || false,
    );
  }

  @Delete(':id/assign-session')
  @ApiOperation({ summary: 'Remove session assignment from a contact' })
  async unassignFromSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactsService.unassignFromSession(id, user.tenantId);
  }
}
