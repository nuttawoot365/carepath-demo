import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError, ApiErrorBody } from './errors';

/**
 * ทุก error ที่ออกจาก API มีรูปเดียวกันเสมอ: { error: { code, message_th, message_en } }
 * error ที่ไม่ใช่ ApiError ไม่เปิดเผยรายละเอียดออกไปข้างนอก
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('api');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiError) {
      response.status(exception.getStatus()).json(exception.getResponse() as ApiErrorBody);
      return;
    }

    // 404 ของ Nest เอง และข้อผิดพลาดจากการแปลง body
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(
        status === 404
          ? { error: { code: 'NOT_FOUND', message_th: 'ไม่พบปลายทางนี้', message_en: 'No such endpoint' } }
          : { error: { code: 'BAD_REQUEST', message_th: 'คำขอไม่ถูกต้อง', message_en: 'Bad request' } },
      );
      return;
    }

    this.logger.error('unhandled error', exception instanceof Error ? exception.stack : String(exception));
    response.status(500).json({
      error: { code: 'INTERNAL', message_th: 'ระบบขัดข้อง', message_en: 'Something went wrong' },
    });
  }
}
